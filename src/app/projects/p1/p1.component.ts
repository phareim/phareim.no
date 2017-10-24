import {Component, OnInit} from '@angular/core';
import {Color} from '../../stuff/s/color';

@Component({
    selector: 'app-p1',
    templateUrl: './p1.component.html',
    styleUrls: ['./p1.component.css']
})
export class P1Component implements OnInit {
    color: string;

    constructor() {
    }

    ngOnInit() {
        this.color = Color.getRandomColor();
    }

    c() {
        this.color = Color.getRandomColor();
    }
}
