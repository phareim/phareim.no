import {Component, OnInit} from '@angular/core';
import {Thing} from './stuff/thing';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    title = 'phareim.no';
    things: Thing[] = [];

    constructor() {
    }

    ngOnInit(): void {
        const number = Math.floor(Math.random() * 100) + 1;
        for (let i = 0; i < number; i++) {
            this.things.push(<Thing>{title: i.toString()});
        }
    }
}
