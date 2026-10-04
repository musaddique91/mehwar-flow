import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  createCustomerSchema,
  createGroupSchema,
  sharePostSchema,
  updateCustomerSchema,
  updateGroupSchema,
  type CreateCustomerInput,
  type CreateGroupInput,
  type CustomerDto,
  type CustomerGroupDto,
  type SharePostInput,
  type SharePostResultDto,
  type UpdateCustomerInput,
  type UpdateGroupInput,
} from '@mehwar/shared';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { CustomersService } from './customers.service';
import { ShareService } from './share.service';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly share: ShareService,
  ) {}

  // ---------- Customers ----------

  @Get()
  async listCustomers(
    @CurrentAuth() auth: AuthContext,
    @Query('q') query?: string,
  ): Promise<CustomerDto[]> {
    return this.customers.listCustomers(auth.organizationId, query);
  }

  @Post()
  async createCustomer(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(createCustomerSchema)) body: CreateCustomerInput,
  ): Promise<CustomerDto> {
    return this.customers.createCustomer(auth.organizationId, body);
  }

  @Patch(':id')
  async updateCustomer(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodPipe(updateCustomerSchema)) body: UpdateCustomerInput,
  ): Promise<CustomerDto> {
    return this.customers.updateCustomer(auth.organizationId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteCustomer(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.customers.deleteCustomer(auth.organizationId, id);
  }

  // ---------- Groups ----------

  @Get('groups')
  async listGroups(@CurrentAuth() auth: AuthContext): Promise<CustomerGroupDto[]> {
    return this.customers.listGroups(auth.organizationId);
  }

  @Post('groups')
  async createGroup(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(createGroupSchema)) body: CreateGroupInput,
  ): Promise<CustomerGroupDto> {
    return this.customers.createGroup(auth.organizationId, body);
  }

  @Patch('groups/:id')
  async updateGroup(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body(new ZodPipe(updateGroupSchema)) body: UpdateGroupInput,
  ): Promise<CustomerGroupDto> {
    return this.customers.updateGroup(auth.organizationId, id, body);
  }

  @Delete('groups/:id')
  @HttpCode(204)
  async deleteGroup(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.customers.deleteGroup(auth.organizationId, id);
  }

  // ---------- Share to Customers ----------

  @Post('share-post')
  async sharePost(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(sharePostSchema)) body: SharePostInput,
  ): Promise<SharePostResultDto> {
    return this.share.sharePostToCustomers(auth.organizationId, body);
  }
}
