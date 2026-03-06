import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuperadminMenuComponent } from './superadmin-menu.component';

describe('SuperadminMenuComponent', () => {
  let component: SuperadminMenuComponent;
  let fixture: ComponentFixture<SuperadminMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuperadminMenuComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuperadminMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
