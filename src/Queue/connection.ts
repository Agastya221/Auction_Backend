import Redis from "ioredis";


const RedisOptions ={
    host:"localhost",
    port:6379
}

export const subClient = new Redis(RedisOptions)
export const pubClient = new Redis(RedisOptions)


export const bullMQConnection = new Redis(RedisOptions)




