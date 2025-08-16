import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from 'src/app/core/services/auth.service';
import { Company } from 'src/app/core/models/company.model';
import { Subscription, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { RouterOutlet } from "@angular/router";
import { DatePipe } from '@angular/common';
import { AnalogClockComponent } from "./analog-clock/analog-clock.component";


@Component({
  selector: 'app-kiosk',
  templateUrl: './kiosk.component.html',
  styleUrls: ['./kiosk.component.css'],
  standalone: false,
  //imports: [RouterOutlet, DatePipe, AnalogClockComponent]
})
export class KioskComponent implements OnInit, OnDestroy {
  activeCompany: Company | null = null;
  timeSubscription!: Subscription;
  currentTime!: Date;
 
  constructor(private authService: AuthService) {
    this.timeSubscription = new Subscription(); // Initialize to satisfy definite assignment
    this.currentTime = new Date(); // Initialize to satisfy definite assignment
  }

  ngOnInit(): void {
    this.authService.activeCompany$.subscribe((company: Company) => {
      this.activeCompany = company;
    });

    this.timeSubscription = timer(0, 1000).pipe(
      map(() => new Date())
    ).subscribe(time => {
      this.currentTime = time;
    });
  }

  ngOnDestroy(): void {
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe();
    }
  }
}
