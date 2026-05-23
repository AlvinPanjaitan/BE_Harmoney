import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getAllCategories(@Req() req: any) {
    const data = await this.categoriesService.findAll(req.user.userId);
    return { msg: 'Categories retrieved successfully', data };
  }

  @Get(':id')
  async getCategoryById(@Req() req: any, @Param('id') id: string) {
    const singleData = await this.categoriesService.findOne(req.user.userId, id);
    return { msg: 'Categories retrieved successfully', data: [singleData] };
  }

  @Post()
  async createCategory(@Req() req: any, @Body() dto: CreateCategoryDto) {
    const data = await this.categoriesService.create(req.user.userId, dto);
    return { msg: 'Category created successfully', data };
  }

  @Put(':id')
  async updateCategory(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const data = await this.categoriesService.update(req.user.userId, id, dto);
    return { msg: 'Category updated successfully', data };
  }

  @Delete(':id')
  async deleteCategory(@Req() req: any, @Param('id') id: string) {
    return this.categoriesService.remove(req.user.userId, id);
  }
}