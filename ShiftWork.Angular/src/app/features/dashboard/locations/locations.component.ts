import { Component, OnInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from 'src/app/core/models/location.model';
import { LocationService } from 'src/app/core/services/location.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { GoogleMap, MapCircle } from '@angular/google-maps';
import { ToastrService } from 'ngx-toastr';
import { MapMarker } from "@angular/google-maps";
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { TIMEZONES } from 'src/app/core/data/timezones';
import { Timezone } from 'src/app/core/models/timezone.model';

@Component({
  selector: 'app-locations',
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.css'],
  standalone: false
})
export class LocationsComponent implements OnInit {
  @ViewChild(GoogleMap, { static: false }) map!: GoogleMap;
  @ViewChild(MapCircle, { static: false }) circle!: MapCircle;
  @ViewChild('addressSearch', { static: true }) addressSearch!: ElementRef;

  timezones: Timezone[] = TIMEZONES;

  activeCompany$: Observable<any>;
  activeCompany: any;
  locations: Location[] = [];
  locationForm!: FormGroup;
  selectedLocation: Location | null = null;
  mapOptions!: google.maps.MapOptions;
  markerOptions: google.maps.MarkerOptions = { draggable: true };
  markerPosition?: google.maps.LatLngLiteral;
  circleOptions: google.maps.CircleOptions = {
    draggable: false,
    strokeColor: '#FF0000',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#FF0000',
    fillOpacity: 0.25,
  };
  loading = false;
  error: any = null;

  constructor(
    private locationService: LocationService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private store: Store<AppState>,
    private ngZone: NgZone
  ) {
    this.activeCompany$ = this.store.select(selectActiveCompany);
  }

  ngOnInit(): void {
    this.activeCompany$.subscribe((company: { companyId: string }) => {
      if (company) {
        this.activeCompany = company;
        this.loading = true;
        this.locationService.getLocations(company.companyId).subscribe(locations => {
            this.locations = locations;
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

    this.setCurrentLocation();

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneExists = this.timezones.some(tz => tz.value === userTimezone);

    if (timezoneExists) {
      this.locationForm.get('timezone')?.setValue(userTimezone);
    }
  }

  ngAfterViewInit(): void {
    const autocomplete = new google.maps.places.Autocomplete(this.addressSearch.nativeElement);
    autocomplete.addListener('place_changed', () => {
      this.ngZone.run(() => {
        const place: google.maps.places.PlaceResult = autocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
          const location = place.geometry.location;
          this.mapOptions = {
            ...this.mapOptions,
            center: location.toJSON()
          };
          this.markerPosition = location.toJSON();
          this.locationForm.patchValue({
            latitude: this.markerPosition.lat,
            longitude: this.markerPosition.lng,
            address: place.formatted_address
          });
          if (this.map) {
            this.map.panTo(location.toJSON());
          }
        }
      });
    });
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
      this.mapOptions = {
        ...this.mapOptions,
        center: this.markerPosition
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
      city: '',
      state: '',
      country: '',
      zipCode: '',
      latitude: 0,
      longitude: 0,
      ratioMax: 100,
      timezone: '',
      email: '',
      phoneNumber: '',
      externalCode: '',
      status: 'Active',
    });

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (this.timezones.some(tz => tz.value === userTimezone)) {
      this.locationForm.get('timezone')?.setValue(userTimezone);
    }
    this.setCurrentLocation();
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
      floor:'',
      region: '',
      street: '',
      building: '',
      department: '',
    };
    delete locationData.latitude;
    delete locationData.longitude;

    if (this.selectedLocation) {
      const updatedLocation: Location = {
        ...this.selectedLocation,
        ...locationData
      };
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

  private setCurrentLocation(): void {
    if (!this.selectedLocation) {
      this.markerPosition = undefined;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          this.mapOptions = { ...this.mapOptions, center: { lat: latitude, lng: longitude } };

          if (!this.selectedLocation) {
            this.markerPosition = { lat: latitude, lng: longitude };
            this.locationForm.patchValue({ latitude, longitude });
          }
        },
        () => this.toastr.info('Could not get current location. Map centered on default.')
      );
    }
  }
}