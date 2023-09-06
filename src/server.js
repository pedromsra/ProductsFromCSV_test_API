require("express-async-errors");

const { prodUp, packUp } = require('./getData')

const AppError = require("./utils/AppError");

const express = require("express");

const app = express();

prodUp()
packUp()

app.use((error, request, response, next) => {
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      status: "error",
      message: error.message
    });
  }

  return response.status(500).json({
    status: "error",
    message: "internal server error"
  })
})

const PORT = 3000;

app.listen(PORT, () => console.log(`Running on Port: ${PORT}`))