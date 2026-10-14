import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { appRoutes } from './app.routes';
import { describe, it, expect, beforeEach } from 'vitest';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(appRoutes)],
    }).compileComponents();
  });

  it('should create root app component', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(app.isChatOpen()).toBe(false);
  });

  it('should toggle chat drawer open and closed', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.toggleChat();
    expect(app.isChatOpen()).toBe(true);

    app.closeChat();
    expect(app.isChatOpen()).toBe(false);
  });
});
