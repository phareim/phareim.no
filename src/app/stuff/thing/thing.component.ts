import {Component, ElementRef, Input, OnInit, Renderer} from '@angular/core';
import {Thing} from '../c/thing';

@Component({
    selector: 'app-thing',
    templateUrl: './thing.component.html',
    styleUrls: ['./thing.component.css']
})
export class ThingComponent implements OnInit {
    @Input() thing: Thing;
    display = 'block';

    constructor() {
    }

    ngOnInit() {
    }

    clickEvent(t: Thing) {
        if (this.thing.clickEvent) {
            t.clickEvent(t);
        } else {
            console.log(this.thing.title);
            this.display = 'none';
        }
    }
}
