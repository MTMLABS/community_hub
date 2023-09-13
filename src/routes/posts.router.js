import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { prisma } from "../utils/prisma/index.js";

const router = express.Router();

// (1) 게시글 생성 API
router.post("/posts", authMiddleware, async (req, res, next) => {
  const { userId } = req.user;
  const { title, content } = req.body;

  const post = await prisma.posts.create({
    data: {
      UserId: userId,
      title,
      content,
    },
  });

  return res.status(201).json({ data: post });
});

// (2) 게시글 목록 조회 API
router.get("/posts", async (req, res, next) => {
  const { postId } = req.params;
  try {
    const posts = await prisma.posts.findMany({
      select: {
        postId: true,
        UserId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        likeCount: true,
        User: {
          select: {
            nickname: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({ data: posts });
  } catch (err) {
    next(err);
  }
});

// (3) 게시글 상세 조회 API
router.get("/posts/:postId", async (req, res, next) => {
  const { postId } = req.params;
  const post = await prisma.posts.findFirst({
    where: { postId: +postId },
    select: {
      postId: true,
      title: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      likeCount: true,
      User: {
        select: {
          nickname: true,
        },
      },
    },
  });

  return res.status(200).json({ data: post });
});

//(4) 게시글 수정 API
router.patch("/posts/:postId", authMiddleware, async (req, res, next) => {
  const { postId } = req.params;
  const { userId } = req.body;
  const updatedData = req.body;

  const postInfo = await prisma.posts.findFirst({
    where: { postId: +postId },
  });

  if (!postInfo) {
    return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
  }

  if (postInfo.UserId !== userId) {
    return res
      .status(404)
      .json({ message: "게시글을 수정할 권한이 없습니다." });
  }

  await prisma.$transaction(
    async (tx) => {
      // 게시글 정보 업데이트
      await tx.posts.update({
        data: {
          ...updatedData,
        },
        where: {
          postId: +postId,
        },
      });

      // 변경된 필드를 PostHistories 테이블에 기록 (추가 구현 필요)
      for (let key in updatedData) {
        if (String(postInfo[key]) !== String(updatedData[key])) {
          await tx.postHistories.create({
            data: {
              PostId: +postId,
              changedField: key,
              oldValue: String(postInfo[key]),
              newValue: String(updatedData[key]),
            },
          });
        }
      }
    },
    {
      // isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    }
  );

  return res.status(200).json({ message: "게시글 정보 변경에 성공했습니다." });
});

// (5) 게시글 삭제 API
router.delete("/posts/:postId", authMiddleware, async (req, res, next) => {
  const { postId } = req.params;
  const { userId } = req.body;

  const post = await prisma.posts.findUnique({
    where: {
      postId: +postId,
    },
  });

  if (!post) {
    return res.status(404).json({ message: "게시글을 찾을 수 없습니다. " });
  }

  if (post.UserId !== userId) {
    return res
      .status(404)
      .json({ message: "게시글을 삭제할 권한이 없습니다. " });
  }

  await prisma.posts.delete({
    where: {
      postId: +postId,
    },
  });

  return res.status(200).json({ message: "게시글이 삭제되었습니다." });
});

export default router;
