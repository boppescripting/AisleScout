import express from 'express'
import cors from 'cors'
import path from 'path'
import { initDb } from './db'
import listsRouter from './routes/lists'
import { listItemsRouter, itemsRouter } from './routes/items'
import walmartRouter from './routes/walmart'
import settingsRouter from './routes/settings'
import { loginHandler, requireAuth } from './auth'

const app = express()
const PORT = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

app.use(express.json())
app.use(cors({
  origin: isProd ? false : 'http://localhost:5173',
  credentials: true,
}))

// Auth — login is public, everything else requires a valid token
app.post('/api/auth/login', loginHandler)
app.use('/api', requireAuth)

app.use('/api/lists', listsRouter)
app.use('/api/lists/:listId/items', listItemsRouter)
app.use('/api/items', itemsRouter)
app.use('/api/walmart', walmartRouter)
app.use('/api/settings', settingsRouter)

if (isProd) {
  const frontendPath = path.join(__dirname, '../frontend')
  app.use(express.static(frontendPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'))
  })
}

initDb().then(() => {
  app.listen(PORT, () => console.log(`AisleScout running on :${PORT}`))
}).catch(err => {
  console.error('Failed to initialize database:', err)
  process.exit(1)
})
