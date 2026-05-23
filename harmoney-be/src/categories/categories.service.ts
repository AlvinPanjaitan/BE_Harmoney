import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // Kolom bersih untuk konsumsi Frontend (tanpa user_id)
  private get categorySelect() {
    return {
      category_id: true,
      type: true,
      name: true,
      icon: true,
    };
  }

  // 1. GET ALL CATEGORIES (Milik User yang Login)
  async findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { user_id: userId },
      select: this.categorySelect,
    });
  }

  // 2. GET CATEGORY BY ID
  async findOne(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { category_id: categoryId, user_id: userId },
      select: this.categorySelect,
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // 3. CREATE CATEGORY (Wajib menyuntikkan user_id)
  async create(userId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        user_id: userId, // 💡 Menjawab eror 'Property user is missing'
        type: dto.type,
        name: dto.name,
        icon: dto.icon || null,
      },
      select: this.categorySelect,
    });
  }

  // 4. UPDATE CATEGORY
  async update(userId: string, categoryId: string, dto: UpdateCategoryDto) {
    await this.findOne(userId, categoryId); // Validasi kepemilikan

    return this.prisma.category.update({
      where: { category_id: categoryId },
      data: {
        name: dto.name,
        icon: dto.icon,
      },
      select: this.categorySelect,
    });
  }

  // 5. DELETE CATEGORY
  async remove(userId: string, categoryId: string) {
    await this.findOne(userId, categoryId);
    await this.prisma.category.delete({
      where: { category_id: categoryId },
    });
    return { msg: 'Category deleted successfully' };
  }
}