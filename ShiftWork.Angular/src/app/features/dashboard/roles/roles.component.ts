import { Component, OnInit } from '@angular/core';
import { Role } from 'src/app/core/models/role.model';
import { RoleService } from 'src/app/core/services/role.service';
import { CompanyService } from 'src/app/core/services/company.service';

@Component({
  selector: 'app-roles',
  templateUrl: './roles.component.html',
  //styleUrls: ['./roles.component.css']
})
export class RolesComponent implements OnInit {

  roles: Role[] = [];
  companyId!: string;

  constructor(private roleService: RoleService, private companyService: CompanyService) { }

  ngOnInit(): void {
    this.companyService.getCompany('1').subscribe(company => {
      this.companyId = company.companyId;
      this.roleService.getRoles(this.companyId).subscribe((data: Role[]) => {
        this.roles = data;
      });
    });
  }

}
