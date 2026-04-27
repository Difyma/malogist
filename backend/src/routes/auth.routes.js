import { Router } from 'express'
import { comparePassword, hashPassword, signToken } from '../lib/auth.js'
import { requireAuth } from '../middleware/auth.js'
import { createUser, findUserByEmail, findUserById } from '../repositories/store.js'

const router = Router()

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {}

  if (!email || !password || !name) {
    return res.status(400).json({ message: 'email, password, name are required' })
  }

  const existing = await findUserByEmail(email)
  if (existing) {
    return res.status(409).json({ message: 'User already exists' })
  }

  try {
    const user = await createUser({
      email,
      passwordHash: hashPassword(password),
      name,
    })

    const token = signToken({ userId: user.id, email: user.email })
    return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } })
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({ message: 'User already exists' })
    }

    throw error
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  const user = await findUserByEmail(email)

  if (!user || !comparePassword(password || '', user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const token = signToken({ userId: user.id, email: user.email })
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await findUserById(req.auth.userId)
  if (!user) return res.status(404).json({ message: 'User not found' })

  return res.json({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt })
})

export default router
