import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { prisma } from "../utils/prisma/index.js";

const router = express.Router();

// 게시글 좋아요
router.post("/posts/:postId/like", authMiddleware, async (req, res, next) => {
  const { postId } = req.params;
  const { userId } = req.user;

  const post = await prisma.posts.findFirst({
    where: { postId: +postId },
  });
  if (!post) {
    return res
      .status(404)
      .json({ errorMessage: "게시글이 존재하지 않습니다." });
  }

  const existingLike = await prisma.likes.findFirst({
    where: {
      PostId: Number(postId),
      UserId: Number(userId),
    },
  });

  if (existingLike) {
    return res.status(400).json({ message: "이미 좋아요를 눌렀습니다." });
  }

  await prisma.likes.create({
    data: {
      PostId: Number(postId),
      UserId: Number(userId),
    },
  });

  await prisma.posts.update({
    where: { postId: Number(postId) },
    data: { likeCount: { increment: 1 } },
  });

  return res.status(200).json({ message: "좋아요 되었습니다." });
});

// 게시글 좋아요 취소
router.delete("/posts/:postId/like", authMiddleware, async (req, res, next) => {
  const { postId } = req.params;
  const { userId } = req.user;

  const existingLike = await prisma.likes.findFirst({
    where: {
      PostId: Number(postId),
      UserId: Number(userId),
    },
  });

  if (!existingLike) {
    return res.status(400).json({ message: "좋아요를 누르지 않았습니다." });
  }

  await prisma.likes.delete({
    where: {
      likeId: existingLike.likeId,
    },
  });

  await prisma.posts.update({
    where: { postId: Number(postId) },
    data: { likeCount: { decrement: 1 } },
  });

  return res.status(200).json({ message: "좋아요가 취소되었습니다." });
});

// 좋아요 누른 게시글 조회
router.get("/posts/likes", authMiddleware, async (req, res, next) => {
  const { postId } = req.params;
  const { userId } = req.user;

  const likedPosts = await prisma.likes.findMany({
    where: {
      PostId: Number(postId),
      UserId: Number(userId),
    },
    include: {
      Post: {
        select: {
          postId: true,
          title: true,
          User: {
            select: {
              nickname: true,
            },
          },
          createdAt: true,
          likeCount: true,
        },
      },
    },
    orderBy: {
      Post: {
        likeCount: "desc",
      },
    },
  });

  const result = likedPosts.map((like) => like.Post);

  res.status(200).json(result);
});

export default router;
