const express = require('express'),
  app = express(),
  server = require('http').Server(app);

const port = 8080
const host = "0.0.0.0"


//health check route 
app.get('/', (req, res) => res.status(200).send('Healthy!'))


//Return a simple hello world message. This can be used to make sure the paths work.
app.get('/hello', (req, res) => res.status(200).send('Hello World!'))

//fallback error response
app.use(function (err, req, res, next) {
  console.error(err)
  res.status(500).json({message: "Error in server layer", err})
})

server.listen(port, host)
console.log(`App running on host:${host} and port:${port}`)


module.exports = app