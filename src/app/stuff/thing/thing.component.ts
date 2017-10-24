import {Component, Input, OnInit} from '@angular/core';
import {Thing} from '../c/thing';

@Component({
    selector: 'app-thing',
    templateUrl: './thing.component.html',
    styleUrls: ['./thing.component.css']
})
export class ThingComponent implements OnInit {
    @Input() thing: Thing;

    constructor() {
    }

    ngOnInit() {
    }

}
