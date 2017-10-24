import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpModule} from '@angular/http';

import {AppComponent} from './app.component';
import {ProjectsModule} from './projects/projects.module';
import { ThingComponent } from './stuff/thing/thing.component';

@NgModule({
    declarations: [
        AppComponent,
        ThingComponent
    ],
    imports: [
        BrowserModule,
        FormsModule,
        HttpModule,
        ProjectsModule
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {
}
