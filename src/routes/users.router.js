// src/routes/users.router.js

import express from "express";
import bcrypt from "bcrypt";
import authMiddleware from "../middlewares/auth.middleware.js";
import { prisma } from "../utils/prisma/index.js";
import { Prisma } from "@prisma/client";

const router = express.Router();

// (1) 회원가입 API
router.post("/sign-up", async (req, res, next) => {
  try {
    const {
      nickname,
      password,
      confirmPassword,
      name,
      age,
      gender,
      profileImage,
    } = req.body;

    // 닉네임 길이 확인
    if (nickname.length < 3) {
      return res
        .status(412)
        .json({ message: "닉네임은 최소 3자 이상이어야 합니다." });
    }

    // 비밀번호 길이 확인
    if (password.length < 4) {
      return res
        .status(412)
        .json({ message: "비밀번호는 최소 4자 이상이어야 합니다." });
    }

    // 비밀번호와 닉네임 비교
    if (password.includes(nickname)) {
      return res
        .status(412)
        .json({ message: "비밀번호에 닉네임을 포함할 수 없습니다." });
    }

    // 비밀번호 확인
    if (password !== confirmPassword) {
      return res.status(412).json({ message: "비밀번호가 일치하지 않습니다." });
    }

    const isExistUser = await prisma.users.findFirst({
      where: {
        nickname,
      },
    });

    if (isExistUser) {
      return res.status(412).json({ message: "이미 존재하는 닉네임입니다." });
    }

    // Users 테이블에 사용자를 추가합니다.
    const hashedPassword = await bcrypt.hash(password, 10);

    const [user, userInfo] = await prisma.$transaction(
      async (tx) => {
        const user = await tx.users.create({
          data: { nickname, password: hashedPassword },
        });

        // UserInfos 테이블에 사용자 정보를 추가합니다.
        const userInfo = await tx.userInfos.create({
          data: {
            UserId: user.userId,
            name,
            age,
            gender: gender.toUpperCase(),
            profileImage,
          },
        });

        return [user, userInfo];
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      }
    );

    return res.status(201).json({ message: "회원가입이 완료되었습니다." });
  } catch (err) {
    next(err);
  }
});

// (2) 로그인 API
router.post("/sign-in", async (req, res, next) => {
  const { nickname, password } = req.body;
  const user = await prisma.users.findFirst({ where: { nickname } });

  if (!user)
    return res.status(401).json({ message: "닉네임 또는 패스워드를 확인해주세요." });
  // 입력받은 사용자의 비밀번호와 데이터베이스에 저장된 비밀번호를 비교합니다.
  else if (!(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: "닉네임 또는 패스워드를 확인해주세요." });

  // 로그인에 성공하면, 사용자의 userId를 바탕으로 토큰을 생성합니다.
  req.session.userId = user.userId;

  return res.status(200).json({ message: "로그인 성공" });
});

// (3) 사용자 조회 API
router.get("/users", authMiddleware, async (req, res, next) => {
  const { userId } = req.user;

  const user = await prisma.users.findFirst({
    where: { userId: +userId },
    select: {
      userId: true,
      nickname: true,
      createdAt: true,
      updatedAt: true,
      UserInfos: {
        // 1:1 관계를 맺고있는 UserInfos 테이블을 조회합니다.
        select: {
          name: true,
          age: true,
          gender: true,
          profileImage: true,
        },
      },
    },
  });

  return res.status(200).json({ data: user });
});

// (4) 사용자 정보 변경 API
router.patch("/users", authMiddleware, async (req, res, next) => {
  const { userId } = req.user;
  const updatedData = req.body;

  const userInfo = await prisma.userInfos.findFirst({
    where: { UserId: +userId },
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.userInfos.update({
        data: {
          ...updatedData,
        },
        where: {
          UserId: +userId,
        },
      });

      for (let key in updatedData) {
        if (userInfo[key] !== updatedData[key]) {
          await tx.userHistories.create({
            data: {
              UserId: +userId,
              changedField: key,
              oldValue: String(userInfo[key]),
              newValue: String(updatedData[key]),
            },
          });
        }
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    }
  );

  return res.status(200).json({ message: "사용자 정보 변경에 성공했습니다." });
});

export default router;
