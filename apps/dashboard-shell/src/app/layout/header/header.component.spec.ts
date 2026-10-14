import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create header component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleChat event on button click', () => {
    let emitted = false;
    component.toggleChat.subscribe(() => {
      emitted = true;
    });

    const button = fixture.nativeElement.querySelector('[data-testid="toggle-chat-button"]');
    button.click();

    expect(emitted).toBe(true);
  });
});
