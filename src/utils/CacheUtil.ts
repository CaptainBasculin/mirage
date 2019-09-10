import redis from './RedisUtil'
import { promisify } from 'util'
const getAsync = promisify(redis.get).bind(redis)
class CacheClass {
  ttl: number
  constructor() {
    this.ttl = 300
  }

  async get(name: string, defaultValue: boolean = false): Promise<any> {
    let val = await getAsync(name)
    if (!val) return defaultValue
    return val
  }
  async set(name: string, value: any) {
    redis.set(name, value, 'EX', this.ttl)
  }
  async setNoExpire(name: string, value: any) {
    redis.set(name, value)
  }
}

const Cache = new CacheClass()

export default Cache
