import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BulletinsComponent } from './bulletins.component';

const routes: Routes = [
  { path: '', component: BulletinsComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BulletinsRoutingModule { }
