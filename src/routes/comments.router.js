import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { prisma } from "../utils/prisma/index.js";

const router = express.Router();

// (1) 댓글 생성 API
router.post(
  "/posts/:postId/comments",
  authMiddleware,
  async (req, res, next) => {
    const { userId } = req.user;
    const { postId } = req.params;
    const { content } = req.body;

    const post = await prisma.posts.findFirst({
      where: { postId: +postId },
    });
    if (!post) {
      return res
        .status(404)
        .json({ errorMessage: "게시글이 존재하지 않습니다." });
    }

    const comment = await prisma.comments.create({
      data: {
        content,
        UserId: +userId,
        PostId: +postId,
      },
    });

    return res.status(201).json({ data: comment });
  }
);

// (2) 댓글 조회 API
router.get("/posts/:postId/comments", async (req, res, next) => {
  const { postId } = req.params;

  const post = await prisma.posts.findFirst({
    where: { postId: +postId },
  });
  if (!post) {
    return res
      .status(404)
      .json({ errorMessage: "게시글이 존재하지 않습니다." });
  }

  const comments = await prisma.comments.findMany({
    where: { PostId: +postId },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json({ data: comments });
});

// (3) 댓글 수정 API
router.patch(
  "/posts/:postId/comments/:commentId",
  authMiddleware,
  async (req, res, next) => {
    const { commentId } = req.params;
    const { userId } = req.body;
    const updatedData = req.body;

    const commentInfo = await prisma.comments.findFirst({
      where: { commentId: +commentId },
    });

    if (!commentInfo) {
      return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
    }

    if (commentInfo.UserId !== userId) {
      return res
        .status(404)
        .json({ message: "댓글을 수정할 권한이 없습니다." });
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.comments.update({
          data: {
            ...updatedData,
          },
          where: {
            commentId: +commentId,
          },
        });

        for (let key in updatedData) {
          if (String(commentInfo[key]) !== String(updatedData[key])) {
            await tx.commentHistories.create({
              data: {
                CommentId: +commentId,
                changedField: key,
                oldValue: String(commentInfo[key]),
                newValue: String(updatedData[key]),
              },
            });
          }
        }
      },
      {
        // isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,  // 필요하다면 활성화
      }
    );

    return res.status(200).json({ message: "댓글 정보 변경에 성공했습니다." });
  }
);

// (4) 댓글 삭제
router.delete(
  "/posts/:postId/comments/:commentId",
  authMiddleware,
  async (req, res, next) => {
    const { postId, commentId } = req.params;
    const { userId } = req.body;

    const comment = await prisma.comments.findUnique({
      where: {
        commentId: +commentId,
      },
    });

    if (!comment) {
      return res.status(404).json({ message: "댓글을 찾을 수 없습니다." });
    }

    if (comment.UserId !== userId) {
      return res
        .status(403)
        .json({ message: "댓글을 삭제할 권한이 없습니다." });
    }

    await prisma.comments.delete({
      where: {
        commentId: +commentId,
      },
    });

    return res.status(200).json({ message: "댓글이 삭제되었습니다." });
  }
);

export default router;
