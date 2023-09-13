// src/app.js

import express from "express";
import cookieParser from "cookie-parser";
import expressSession from "express-session";
import expressMySQLSession from "express-mysql-session";
import dotEnv from "dotenv";
import UsersRouter from "./routes/users.router.js";
import logMiddleware from "./middlewares/log.middleware.js";
import errorHandlingMiddleware from "./middlewares/error-handling.middleware.js";
import PostsRouter from "./routes/posts.router.js ";
import CommentsRouter from "./routes/comments.router.js";
import LikesRouter from "./routes/likes.router.js";

dotEnv.config();

const app = express();
const PORT = 3018;

const MySQLStorage = expressMySQLSession(expressSession);
const sessionStore = new MySQLStorage({
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_NAME,
  expiration: 1000 * 60 * 60 * 24, // 1일동안 세션 사용
  createDatabaseTable: true,
});

app.use(logMiddleware);
app.use(express.json());
app.use(cookieParser());
app.use(
  expressSession({
    secret: process.env.SESSION_SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, //1일 동안 사용할 수 있도록 설정.
    },
  })
);
app.use("/api", [UsersRouter, PostsRouter, CommentsRouter, LikesRouter]);
app.use(errorHandlingMiddleware);

app.listen(PORT, () => {
  console.log(PORT, "포트로 서버가 열렸어요!");
});
