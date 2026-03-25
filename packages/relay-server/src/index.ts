import { createApp } from './app.js'
import { startCleanup } from './store.js'

export { createApp } from './app.js'
export { startLocalRelay } from './local.js'

const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const app = createApp()

startCleanup()

app.listen(port, () => {
  console.log(`Relay server listening on port ${port}`)
})
