import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TimerService {
  private countdown$ = new BehaviorSubject<number>(0);

  get countdown(): Observable<number> {
    return this.countdown$.asObservable();
  }

  set countdown(value: number) {
    //this.countdown$ = new BehaviorSubject<number>(value);
    this.countdown$.next(value);
  }

   startTimer() {
    const interval = setInterval(() => {
      const currentCount = this.countdown$.value - 1;
      if (currentCount >= 0) {
        this.countdown$.next(currentCount);
      } else {
        clearInterval(interval);
        //this.countdown$.complete();
      }
    }, 1000);
  }

  customTimer(value: number){
    const newCount = value;
    //this.countdown$ = new BehaviorSubject<number>(newCount);
    this.countdown$.next(newCount);
    this.startTimer();
  }
}