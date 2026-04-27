import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10)
}

export function comparePassword(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash)
}

export function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_TTL })
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET)
}
