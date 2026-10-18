import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { McpGuard } from './mcp.guard';
import { McpService } from './mcp.service';

@ApiExcludeController()
@Controller('mcp')
@UseGuards(McpGuard)
export class McpController {
  constructor(
    @Inject(McpService)
    private readonly mcpService: McpService
  ) {}

  @Post()
  async handlePost(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply
  ): Promise<void> {
    await this.mcpService.handleRequest(req, reply);
  }

  @Get()
  handleGet(@Res() reply: FastifyReply) {
    return reply.status(HttpStatus.METHOD_NOT_ALLOWED).send({
      statusCode: HttpStatus.METHOD_NOT_ALLOWED,
      error: 'Method Not Allowed',
      message: 'Method GET not allowed on /api/mcp. Use POST with Streamable HTTP.',
    });
  }

  @Delete()
  handleDelete(@Res() reply: FastifyReply) {
    return reply.status(HttpStatus.METHOD_NOT_ALLOWED).send({
      statusCode: HttpStatus.METHOD_NOT_ALLOWED,
      error: 'Method Not Allowed',
      message: 'Method DELETE not allowed on /api/mcp. Use POST with Streamable HTTP.',
    });
  }

  @Put()
  handlePut(@Res() reply: FastifyReply) {
    return reply.status(HttpStatus.METHOD_NOT_ALLOWED).send({
      statusCode: HttpStatus.METHOD_NOT_ALLOWED,
      error: 'Method Not Allowed',
      message: 'Method PUT not allowed on /api/mcp. Use POST with Streamable HTTP.',
    });
  }

  @Patch()
  handlePatch(@Res() reply: FastifyReply) {
    return reply.status(HttpStatus.METHOD_NOT_ALLOWED).send({
      statusCode: HttpStatus.METHOD_NOT_ALLOWED,
      error: 'Method Not Allowed',
      message: 'Method PATCH not allowed on /api/mcp. Use POST with Streamable HTTP.',
    });
  }
}
