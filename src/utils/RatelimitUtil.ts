import RateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import client from './RedisUtil'
import ms from 'ms'

const store = new RedisStore({
  client,
  prefix: 'mirage_rl'
})

const limiter = RateLimit({
  store,
  max: 100,
  windowMs: ms('5m'),
  message: JSON.stringify({
    error: 'Too many requests'
  })
})

const authLimiter = RateLimit({
  store,
  max: 25,
  windowMs: ms('30m'),
  message: 'Too many /auth requests. Try again later.'
})

const pasteLimiter = RateLimit({
  store,
  max: 5,
  windowMs: ms('1m'),
  message: 'Too many pastes. Try again later.'
})

export { limiter, authLimiter, pasteLimiter }
