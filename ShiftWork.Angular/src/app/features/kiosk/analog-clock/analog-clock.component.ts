import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-analog-clock',
  templateUrl: './analog-clock.component.html',
  styleUrls: ['./analog-clock.component.scss'],
   imports: [CommonModule],
})
export class AnalogClockComponent implements OnInit, OnDestroy {
  hourHandTransform!: string;
  minuteHandTransform!: string;
  secondHandTransform!: string;
  numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  private intervalId: any;

  ngOnInit(): void {
    this.intervalId = setInterval(() => this.updateClock(), 1000);
    this.updateClock(); // Initial call to avoid delay
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  updateClock(): void {
    const now = new Date();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();

    const secondDeg = (seconds / 60) * 360;
    const minuteDeg = (minutes / 60) * 360 + (seconds / 60) * 6;
    const hourDeg = (hours / 12) * 360 + (minutes / 60) * 30;

    this.hourHandTransform = `translateX(-50%) rotate(${hourDeg}deg)`;
    this.minuteHandTransform = `translateX(-50%) rotate(${minuteDeg}deg)`;
    this.secondHandTransform = `translateX(-50%) rotate(${secondDeg}deg)`;
  }
}