import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProfileDto) {
    return this.prisma.profile.create({ data: dto });
  }

  findOne(accountId: number) {
    return this.prisma.profile.findUnique({ where: { accountId } });
  }

  update(id: number, dto: UpdateProfileDto) {
    return this.prisma.profile.update({ where: { id }, data: dto });
  }
}
