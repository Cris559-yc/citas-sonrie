// API REST de Citas - Clinica Dental Sonrie
// Stack moderno: Node.js + Express + PostgreSQL. Credenciales por variables de entorno.
const express = require('express');
const os = require('os');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
const EMPRESA = process.env.EMPRESA || 'Cliente';
const app = express();
app.use(express.json());

async function initDb(intento = 1) {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS citas (
      id SERIAL PRIMARY KEY,
      paciente VARCHAR(100) NOT NULL,
      telefono VARCHAR(20),
      fecha TIMESTAMP NOT NULL,
      motivo VARCHAR(150),
      creado TIMESTAMP DEFAULT NOW())`);
    console.log('Base de datos lista');
  } catch (err) {
    console.log(`BD no disponible (intento ${intento}): ${err.message}`);
    setTimeout(() => initDb(intento + 1), 3000);
  }
}

app.get('/api/estado', async (req, res) => {
  try {
    const r = await pool.query('SELECT version()');
    res.json({ empresa: EMPRESA, pod: os.hostname(), node: process.version, postgres: r.rows[0].version });
  } catch (err) { res.status(503).json({ error: err.message }); }
});
app.get('/api/citas', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM citas ORDER BY fecha')).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/citas/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM citas WHERE id = $1', [req.params.id]);
    r.rows.length ? res.json(r.rows[0]) : res.status(404).json({ error: 'Cita no encontrada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/citas', async (req, res) => {
  const { paciente, telefono, fecha, motivo } = req.body;
  if (!paciente || !fecha) return res.status(400).json({ error: 'paciente y fecha son obligatorios' });
  try {
    const r = await pool.query('INSERT INTO citas (paciente, telefono, fecha, motivo) VALUES ($1, $2, $3, $4) RETURNING *',
      [paciente, telefono, fecha, motivo]);
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/citas/:id', async (req, res) => {
  const { paciente, telefono, fecha, motivo } = req.body;
  try {
    const r = await pool.query('UPDATE citas SET paciente = $1, telefono = $2, fecha = $3, motivo = $4 WHERE id = $5 RETURNING *',
      [paciente, telefono, fecha, motivo, req.params.id]);
    r.rows.length ? res.json(r.rows[0]) : res.status(404).json({ error: 'Cita no encontrada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/citas/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM citas WHERE id = $1 RETURNING id', [req.params.id]);
    r.rows.length ? res.json({ eliminada: r.rows[0].id }) : res.status(404).json({ error: 'Cita no encontrada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Citas - ${EMPRESA}</title>
<style>body{font-family:Arial,sans-serif;margin:30px;background:#eef6fb;color:#333}h1{color:#1b6a8c}
table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #ccc;padding:8px}th{background:#1b6a8c;color:#fff}
.caja{background:#fff;padding:15px;margin-bottom:20px;border:1px solid #ccc}input{margin:4px;padding:5px}footer{margin-top:25px;font-size:12px;color:#777}</style>
</head><body><h1>${EMPRESA} - Agenda de Citas</h1>
<div class="caja"><h3>Nueva cita</h3>
<input id="paciente" placeholder="Paciente"><input id="telefono" placeholder="Teléfono">
<input id="fecha" type="datetime-local"><input id="motivo" placeholder="Motivo">
<button onclick="crear()">Agendar</button></div>
<table><thead><tr><th>ID</th><th>Paciente</th><th>Teléfono</th><th>Fecha</th><th>Motivo</th><th></th></tr></thead><tbody id="tabla"></tbody></table>
<footer id="estado"></footer>
<script>
async function cargar(){const r=await fetch('/api/citas');const c=await r.json();
document.getElementById('tabla').innerHTML=c.map(x=>'<tr><td>'+x.id+'</td><td>'+x.paciente+'</td><td>'+(x.telefono||'')+'</td><td>'+new Date(x.fecha).toLocaleString()+'</td><td>'+(x.motivo||'')+'</td><td><button onclick="borrar('+x.id+')">Eliminar</button></td></tr>').join('');
const e=await (await fetch('/api/estado')).json();document.getElementById('estado').textContent='Servido por el pod '+e.pod+' | Node '+e.node+' | '+(e.postgres||'').split(' on ')[0];}
async function crear(){const b={paciente:paciente.value,telefono:telefono.value,fecha:fecha.value,motivo:motivo.value};
const r=await fetch('/api/citas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(!r.ok)alert((await r.json()).error);cargar();}
async function borrar(id){if(confirm('¿Eliminar cita?')){await fetch('/api/citas/'+id,{method:'DELETE'});cargar();}}
cargar();
</script></body></html>`);
});

initDb();
app.listen(3000, () => console.log(`API de ${EMPRESA} escuchando en el puerto 3000`));
