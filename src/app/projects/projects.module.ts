import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {P1Component} from './p1/p1.component';
import {RouterModule, Routes} from '@angular/router';
import {BackComponent} from './c/back/back.component';
import {P2Component} from './p2/p2.component';
import {P3Component} from './p3/p3.component';
import {FormsModule} from '@angular/forms';

const appRoutes: Routes = [
    {path: '1', component: P1Component},
    {path: '2', component: P2Component},
    {path: '3', component: P3Component}];


@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        RouterModule.forRoot(
            appRoutes,
            {enableTracing: false, useHash: false}
        )
    ],
    declarations: [P1Component, BackComponent, P2Component, P3Component],
    exports: [BackComponent]
})
export class ProjectsModule {
}
