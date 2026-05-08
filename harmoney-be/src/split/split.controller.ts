import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { SplitService } from './split.service';

@Controller('api/split')
export class SplitController {
  constructor(
    private readonly splitService: SplitService,
  ) {}

  // =========================
  // SCAN
  // =========================

  @Post('scan/:sessionId')
  @UseInterceptors(
    FileInterceptor('image'),
  )
  async scan(
    @Param('sessionId') sid: string,
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    const pythonRawResponse =
      await this.splitService.callOcrService(
        file,
      );

    const data =
      this.splitService.syncOcrToSession(
        sid,
        pythonRawResponse,
      );

    return {
      status: 'success',
      data,
    };
  }

  // =========================
  // SESSION
  // =========================

  @Get(':sessionId')
  getSession(
    @Param('sessionId') sid: string,
  ) {
    return {
      status: 'success',
      data: this.splitService.getSession(
        sid,
      ),
    };
  }

  // =========================
  // FRIENDS
  // =========================

  @Post('friend/:sessionId')
  addFriend(
    @Param('sessionId') sid: string,
    @Body('name') name: string,
  ) {
    return {
      status: 'success',
      data: this.splitService.addFriend(
        sid,
        name,
      ),
    };
  }

  @Patch(
    'friend/:sessionId/:oldName',
  )
  editFriend(
    @Param('sessionId') sid: string,
    @Param('oldName')
    oldName: string,
    @Body('newName')
    newName: string,
  ) {
    return {
      status: 'success',
      data: this.splitService.editFriend(
        sid,
        oldName,
        newName,
      ),
    };
  }

  @Delete(
    'friend/:sessionId/:name',
  )
  deleteFriend(
    @Param('sessionId') sid: string,
    @Param('name') name: string,
  ) {
    return {
      status: 'success',
      data:
        this.splitService.deleteFriend(
          sid,
          name,
        ),
    };
  }

  // =========================
  // ITEMS
  // =========================

  @Post('item/:sessionId')
  addItem(
    @Param('sessionId') sid: string,
    @Body()
    body: {
      name: string;
      qty: number;
      price: number;
    },
  ) {
    return {
      status: 'success',
      data: this.splitService.addItem(
        sid,
        body,
      ),
    };
  }

  @Patch(
    'item/:sessionId/:itemId',
  )
  editItem(
    @Param('sessionId') sid: string,
    @Param('itemId')
    itemId: string,
    @Body() body: any,
  ) {
    return {
      status: 'success',
      data: this.splitService.editItem(
        sid,
        itemId,
        body,
      ),
    };
  }

  @Delete(
    'item/:sessionId/:itemId',
  )
  deleteItem(
    @Param('sessionId') sid: string,
    @Param('itemId')
    itemId: string,
  ) {
    return {
      status: 'success',
      data: this.splitService.deleteItem(
        sid,
        itemId,
      ),
    };
  }

  // =========================
  // ASSIGN
  // =========================

  @Put(
    'assign/:sessionId/:itemId',
  )
  assign(
    @Param('sessionId') sid: string,
    @Param('itemId')
    itemId: string,
    @Body('friends')
    friends: string[],
  ) {
    return {
      status: 'success',
      data:
        this.splitService.assignItem(
          sid,
          itemId,
          friends,
        ),
    };
  }

  // =========================
  // SUMMARY
  // =========================

  @Get('summary/:sessionId')
  summary(
    @Param('sessionId') sid: string,
  ) {
    return {
      status: 'success',
      data:
        this.splitService.getSummary(
          sid,
        ),
    };
  }
}