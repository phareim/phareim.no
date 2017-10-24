import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {P1Component} from './p1/p1.component';
import {RouterModule, Routes} from '@angular/router';

const appRoutes: Routes = [
    {path: 'p/1', component: P1Component}];


@NgModule({
    imports: [
        CommonModule,
        RouterModule.forRoot(
            appRoutes,
            {enableTracing: true, useHash: false} // <-- debugging purposes only
        )
    ],
    declarations: [P1Component]
})
export class ProjectsModule {
}
