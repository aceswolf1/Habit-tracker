import "reflect-metadata";
import express from "express";
import cors from "cors";
import { AppDataSource } from "../ormconfig";
import monthRouter from "./routes/month";
import taskRouter from "./routes/task";

const app = express();
app.use(express.json());

// Request logger middleware
import { logger } from "./middleware/errorHandler";

app.use(
  cors({
    origin: "http://localhost:3001",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  })
);

app.use((req, res, next) => {
  logger.info({
    message: "Incoming request",
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  });
  next();
});

app.use("/tasks", taskRouter);
app.use("/months", monthRouter);

// Error handler middleware (should be last)
import errorHandler from "./middleware/errorHandler";
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

AppDataSource.initialize()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => console.log(error));
