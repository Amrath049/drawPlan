import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoardDto, UpdateBoardDto } from './dto/board.dto';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBoardDto) {
    return this.prisma.board.create({
      data: {
        name: dto.name,
        ownerId: userId,
        elements: [],
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.board.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId !== userId) throw new ForbiddenException();

    return board;
  }

  async update(boardId: string, userId: string, dto: UpdateBoardDto) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId !== userId) throw new ForbiddenException();

    return this.prisma.board.update({
      where: { id: boardId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.elements !== undefined && {
          elements: dto.elements as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async remove(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId !== userId) throw new ForbiddenException();

    await this.prisma.board.delete({ where: { id: boardId } });
    return { message: 'Board deleted' };
  }
}
