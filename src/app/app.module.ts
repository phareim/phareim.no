import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpModule} from '@angular/http';

import {AppComponent} from './app.component';
import {ProjectsModule} from './projects/projects.module';
import {ThingComponent} from './stuff/thing/thing.component';
import {RouterModule, Routes} from '@angular/router';
import {P1Component} from './projects/p1/p1.component';
import {ThingsComponent} from './stuff/things/things.component';

const appRoutes: Routes = [
    {path: '1', component: P1Component},
    {path: '', component: ThingsComponent},
    {path: '**', component: ThingsComponent}
];


@NgModule({
    declarations: [
        AppComponent,
        ThingComponent,
        ThingsComponent
    ],
    imports: [
        BrowserModule,
        FormsModule,
        HttpModule,
        ProjectsModule,
        RouterModule.forRoot(
            appRoutes,
            {enableTracing: true, useHash: false} // <-- debugging purposes only
        )
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {
}
