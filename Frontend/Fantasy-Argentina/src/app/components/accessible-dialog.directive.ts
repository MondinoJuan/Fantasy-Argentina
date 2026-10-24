import { AfterViewInit, Directive, ElementRef, EventEmitter, HostListener, OnDestroy, Output } from '@angular/core';

@Directive({ selector: '[appAccessibleDialog]', standalone: true, host: { role: 'dialog', 'aria-modal': 'true', tabindex: '-1' } })
export class AccessibleDialogDirective implements AfterViewInit, OnDestroy {
  @Output() dialogEscape = new EventEmitter<void>();
  private previousFocus = document.activeElement as HTMLElement | null;
  constructor(private element: ElementRef<HTMLElement>) {}
  private controls(): HTMLElement[] {
    return Array.from(this.element.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]'))
      .filter(element => element.getClientRects().length > 0);
  }
  ngAfterViewInit(): void { (this.controls()[0] ?? this.element.nativeElement).focus(); }
  @HostListener('keydown', ['$event'])
  keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.dialogEscape.emit(); }
    if (event.key !== 'Tab') return;
    const controls = this.controls();
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); this.element.nativeElement.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === this.element.nativeElement)) { event.preventDefault(); last!.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === this.element.nativeElement)) { event.preventDefault(); first.focus(); }
  }
  ngOnDestroy(): void { if (this.previousFocus?.isConnected) this.previousFocus.focus(); }
}
