import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  createAccountForUser,
  deleteAccountForUser,
  findAccountByIdForUser,
  listAccountsByUser,
  updateAccountForUser,
} from '../repositories/store.js'

const router = Router()

router.use(requireAuth)

router.post('/', async (req, res) => {
  const { name, marketplaceType, apiKey, clientId } = req.body ?? {}
  if (!name || !marketplaceType || !apiKey) {
    return res.status(400).json({ message: 'name, marketplaceType, apiKey are required' })
  }

  const account = await createAccountForUser(req.auth.userId, {
    name,
    marketplaceType,
    apiKey,
    clientId,
  })

  return res.status(201).json(account)
})

router.get('/', async (req, res) => {
  const items = await listAccountsByUser(req.auth.userId)
  return res.json(items)
})

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const item = await findAccountByIdForUser(id, req.auth.userId)
  if (!item) return res.status(404).json({ message: 'Account not found' })
  return res.json(item)
})

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const item = await updateAccountForUser(id, req.auth.userId, req.body ?? {})
  if (!item) return res.status(404).json({ message: 'Account not found' })

  return res.json(item)
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const deleted = await deleteAccountForUser(id, req.auth.userId)
  if (!deleted) return res.status(404).json({ message: 'Account not found' })

  return res.status(204).send()
})

export default router
