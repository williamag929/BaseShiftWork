import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentsRoutingModule } from './documents-routing.module';
import { DocumentsComponent } from './documents.component';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  declarations: [DocumentsComponent],
  imports: [CommonModule, DocumentsRoutingModule, SharedModule]
})
export class DocumentsModule { }
