import { Controller, Get, Render } from '@nestjs/common';

@Controller()
export class ViewController {
  @Get(['/', '*'])
  @Render('index')
  render(): Record<string, never> {
    return {};
  }
}
