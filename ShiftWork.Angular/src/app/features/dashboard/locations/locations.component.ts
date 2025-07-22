import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from 'src/app/core/models/location.model';
import { LocationService } from 'src/app/core/services/location.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { GoogleMap, MapCircle } from '@angular/google-maps'; // This import is not needed if GoogleMap and MapCircle are not used in the template or directly in the component logic.
import { ToastrService } from 'ngx-toastr';
import { MapMarker } from "../../../../../node_modules/@angular/google-maps/index"; // Import ToastrService
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';

@Component({
  selector: 'app-locations',
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.css'],
  standalone: false // Ensure these are imported if using standalone components
  //    GoogleMap, MapMarker, MapCircle
})
export class LocationsComponent implements OnInit {
  @ViewChild(GoogleMap, { static: false }) map!: GoogleMap;
  @ViewChild(MapCircle, { static: false }) circle!: MapCircle;

  activeCompany$: Observable<any>;
  activeCompany: any;
  locations: Location[] = [];
  locationForm!: FormGroup;
  selectedLocation: Location | null = null;
  mapOptions!: google.maps.MapOptions;
  markerOptions: google.maps.MarkerOptions = { draggable: false }; // Consider updating if you want to avoid deprecation
  markerPosition?: google.maps.LatLngLiteral;
  circleOptions: google.maps.CircleOptions = { draggable: true };
  loading = false;
  error: any = null;

  constructor(
    private locationService: LocationService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {

    this.activeCompany$.subscribe((company: { companyId: string }) => {
      if (company) {
        this.activeCompany = company;
        console.log('Active company set:', this.activeCompany);
        this.loading = true;
        this.locationService.getLocations(company.companyId).subscribe(
          (locations: Location[]) => {
            this.locations = locations.filter((l: Location) => l.companyId === company.companyId);
            this.loading = false;
          },
          (error: any) => {
            this.error = error;
            this.loading = false;
          }
        );
      }
    });

    this.locationForm = this.fb.group({
      name: ['', Validators.required],
      address: ['', Validators.required],
      city: [''],
      state: [''],
      country: [''],
      zipCode: [''],
      latitude: [0, Validators.required],
      longitude: [0, Validators.required],
      ratioMax: [100, Validators.required],
      timezone: [''],
      email: ['', [Validators.email]],
      phoneNumber: [''],
      externalCode: [''],
      status: ['Active', Validators.required],
    });

    this.mapOptions = {
      center: { lat: 36.1699, lng: -115.1398 }, // Default to Las Vegas
      zoom: 12
    };
  }

  editLocation(location: Location): void {
    this.selectedLocation = location;
    this.locationForm.patchValue({
      ...location,
      latitude: location.geoCoordinates?.latitude,
      longitude: location.geoCoordinates?.longitude
    });

    if (location.geoCoordinates) {
      this.markerPosition = {
        lat: location.geoCoordinates.latitude,
        lng: location.geoCoordinates.longitude
      };
      if (this.map) {
        this.map.panTo(this.markerPosition);
      }
    }
  }

  cancelEdit(): void {
    this.selectedLocation = null;
    this.locationForm.reset({
      name: '',
      address: '',
      latitude: 0,
      longitude: 0,
      ratioMax: 100,
      status: 'Active'
    });
    this.markerPosition = undefined;
  }

  onMapClick(event: google.maps.MapMouseEvent): void {
    if (event.latLng) {
      this.markerPosition = event.latLng.toJSON();
      this.locationForm.patchValue({
        latitude: this.markerPosition.lat,
        longitude: this.markerPosition.lng
      });
    }
  }
  saveLocation(): void {
    if (!this.locationForm.valid) {
      return;
    }

    const formValue = this.locationForm.value;
    const locationData = {
      ...formValue,
      geoCoordinates: {
        latitude: formValue.latitude,
        longitude: formValue.longitude,
      },
    };
    delete locationData.latitude;
    delete locationData.longitude;

    if (this.selectedLocation) {
      const updatedLocation: Location = {
        ...this.selectedLocation,
        ...locationData
      };
      // Note: You will need to implement `updateLocation` in your LocationService.
      this.locationService.updateLocation(this.activeCompany.companyId, updatedLocation.locationId, updatedLocation).subscribe(
        (result) => {
          const index = this.locations.findIndex(l => l.locationId === result.locationId);
          if (index > -1) {
            this.locations[index] = result;
          }
          this.toastr.success('Location updated successfully.');
          this.cancelEdit();
        },
        () => this.toastr.error('Failed to update location.')
      );
    } else {
      const newLocation = { ...locationData, companyId: this.activeCompany.companyId } as Location;
      this.locationService.createLocation(this.activeCompany.companyId, newLocation).subscribe((location: Location) => {
        this.locations.push(location);
        this.toastr.success('Location created successfully');
        this.cancelEdit();
      });
    }
  }
}
