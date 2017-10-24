import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {P1Component} from './p1/p1.component';
import {RouterModule, Routes} from '@angular/router';
import {BackComponent} from './c/back/back.component';
import { P2Component } from './p2/p2.component';

const appRoutes: Routes = [
    {path: '1', component: P1Component}];


@NgModule({
    imports: [
        CommonModule,
        RouterModule.forRoot(
            appRoutes,
            {enableTracing: true, useHash: false} // <-- debugging purposes only
        )
    ],
    declarations: [P1Component, BackComponent, P2Component],
    exports: [BackComponent]
})
export class ProjectsModule {
}
