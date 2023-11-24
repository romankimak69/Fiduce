require('dotenv').config()
const app = require('./app')
const chat = require('./routes/chat')

const http = require('http').Server(app)
const io = require('socket.io')(http)

io.on('connection', (socket) => { })

var server = http.listen(process.env.PORT ?? 3000, () => {
  console.log('Server is on port', server.address().port)
})

chat.setIO(io)
