import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const manager = '11111111-1111-4111-8111-111111111111';
const operatorA = '22222222-2222-4222-8222-222222222222';
const operatorB = '33333333-3333-4333-8333-333333333333';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true),'') $$;
  `);
  await db.exec(await fs.readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const [id, email] of [[manager,'gestor@atori.test'],[operatorA,'a@atori.test'],[operatorB,'b@atori.test']])
    await db.query('insert into auth.users(id,email) values ($1,$2)', [id,email]);
  await db.query("update public.profiles set role='gestor' where id=$1", [manager]);
  return db;
}

async function as(db, id) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.role','authenticated',false)", [id]);
}

async function scalar(db, sql, args = []) {
  const result = await db.query(sql, args);
  return Object.values(result.rows[0])[0];
}

test('fila exclusiva, expiração e reimportação preservam o trabalho comercial', async () => {
  const db = await setup();
  try {
    await as(db, manager);
    const rows = [
      { id:'ATL-AAAAAAAAAA', place_id:'place-a', name:'Clínica A', phone:'+55 11 1111-1111', whatsapp_url:'https://wa.me/5511111111111' },
      { id:'ATL-BBBBBBBBBB', place_id:'place-b', name:'Clínica B', phone:'+55 11 2222-2222' },
      { id:'ATL-CCCCCCCCCC', place_id:'place-c', name:'Clínica C', phone:null }
    ];
    assert.equal(await scalar(db, 'select public.import_leads($1::jsonb)', [JSON.stringify(rows)]), 3);
    await db.query("select public.set_validation('ATL-AAAAAAAAAA','validado')");
    await db.query("select public.set_validation('ATL-BBBBBBBBBB','validado')");
    await db.query("select public.set_validation('ATL-CCCCCCCCCC','validado')");
    await as(db, operatorA);
    const first = await scalar(db, "select (public.claim_lead('novo')).id");
    await as(db, operatorB);
    const second = await scalar(db, "select (public.claim_lead('novo')).id");
    assert.notEqual(first, second);
    assert.deepEqual(new Set([first,second]), new Set(['ATL-AAAAAAAAAA','ATL-BBBBBBBBBB']));
    assert.equal(await scalar(db, "select (public.claim_lead('novo')).id"), second, 'a própria reserva é retomada');
    await as(db, operatorA);
    await db.query('select public.release_lead($1,$2)', [first,'Pesquisar o contato antes de ligar']);
    assert.equal(await scalar(db, 'select call_attempts from public.leads where id=$1', [first]), 0);
    await as(db, operatorB);
    await db.query("update public.leads set reserved_until=now()-interval '1 minute' where id=$1", [second]);
    const reclaimed = await scalar(db, "select (public.claim_lead('novo')).id");
    assert.ok([first,second].includes(reclaimed));
    await db.query("update public.leads set reserved_until=now()-interval '1 minute' where id=$1", [reclaimed]);
    await as(db, manager);
    const changed = rows.map(row => ({ ...row, name: row.name + ' atualizada' }));
    await db.query('select public.import_leads($1::jsonb)', [JSON.stringify(changed)]);
    assert.equal(await scalar(db, 'select count(*)::int from public.leads'), 3);
    assert.equal(await scalar(db, 'select count(*)::int from public.contact_events'), 7);
    assert.equal(await scalar(db, 'select validation from public.leads where id=$1', [first]), 'validado');
    assert.equal(await scalar(db, 'select name from public.leads where id=$1', [first]), 'Clínica ' + (first.includes('AAAAAAAAAA') ? 'A' : 'B') + ' atualizada');
  } finally { await db.close(); }
});

test('segunda tentativa sem resposta exige retorno e só permite WhatsApp explícito', async () => {
  const db = await setup();
  try {
    await as(db, manager);
    await db.query('select public.import_leads($1::jsonb)', [JSON.stringify([
      { id:'ATL-AAAAAAAAAA', name:'Com WhatsApp', phone:'111', whatsapp_url:'https://wa.me/55111' },
      { id:'ATL-BBBBBBBBBB', name:'Sem WhatsApp', phone:'222' }
    ])]);
    await db.query("select public.set_validation('ATL-AAAAAAAAAA','validado')");
    await db.query("select public.set_validation('ATL-BBBBBBBBBB','validado')");
    await as(db, operatorA);
    // Remove aleatoriedade deste teste deixando um único lead elegível.
    await db.query("update public.leads set validation='pendente' where id='ATL-BBBBBBBBBB'");
    const id = await scalar(db, "select (public.claim_lead('novo')).id");
    await assert.rejects(db.query('select public.record_call($1,$2,$3,$4)', [id,'sem_resposta','',null]), /Agende um retorno futuro/);
    await assert.rejects(db.query('select public.record_call($1,$2,$3,now()+interval \'1 hour\',$4)', [id,'sem_resposta','',true]), /WhatsApp indisponível/);
    assert.equal(await scalar(db, 'select call_attempts from public.leads where id=$1', [id]), 0);
    await db.query('select public.record_call($1,$2,$3,now()+interval \'1 hour\')', [id,'sem_resposta','Não atendeu']);
    await db.query("update public.leads set next_followup_at=now()-interval '1 minute' where id=$1", [id]);
    assert.equal(await scalar(db, "select (public.claim_lead('retorno')).id"), id);
    await db.query('select public.record_call($1,$2,$3,now()+interval \'1 day\',$4)', [id,'sem_resposta','Mensagem manual enviada',true]);
    assert.equal(await scalar(db, 'select call_attempts from public.leads where id=$1', [id]), 2);
    assert.equal(await scalar(db, 'select details->>\'whatsapp_enviado\' from public.contact_events where kind=\'sem_resposta\' order by id desc limit 1'), 'true');
    await as(db, manager);
    await db.query('select public.import_leads($1::jsonb)', [JSON.stringify([{ id, name:'Nome atualizado', phone:'111', whatsapp_url:'https://wa.me/55111' }])]);
    assert.equal(await scalar(db, 'select call_attempts from public.leads where id=$1', [id]), 2);
    assert.ok(await scalar(db, 'select next_followup_at from public.leads where id=$1', [id]));
    await as(db, operatorA);
    await db.query("update public.leads set validation='validado',call_attempts=1,contact_status='sem_resposta',next_followup_at=now()-interval '1 minute' where id='ATL-BBBBBBBBBB'");
    const withoutWhatsapp = await scalar(db, "select (public.claim_lead('retorno')).id");
    assert.equal(withoutWhatsapp, 'ATL-BBBBBBBBBB');
    await assert.rejects(db.query('select public.record_call($1,$2,$3,now()+interval \'1 day\',$4)', [withoutWhatsapp,'sem_resposta','',true]), /WhatsApp indisponível/);
    await db.query('select public.record_call($1,$2,$3,now()+interval \'1 day\')', [withoutWhatsapp,'sem_resposta','']);
    assert.equal(await scalar(db, 'select call_attempts from public.leads where id=$1', [withoutWhatsapp]), 2);
  } finally { await db.close(); }
});
