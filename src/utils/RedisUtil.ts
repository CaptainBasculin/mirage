import Redis from 'redis'

const redis = Redis.createClient({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT!, 10)
})

export default redis
