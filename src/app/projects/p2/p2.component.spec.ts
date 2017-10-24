import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { P2Component } from './p2.component';

describe('P2Component', () => {
  let component: P2Component;
  let fixture: ComponentFixture<P2Component>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ P2Component ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(P2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
