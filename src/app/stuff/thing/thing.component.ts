import {Component, ElementRef, EventEmitter, Input, OnInit, Output, Renderer} from '@angular/core';
import {Thing} from '../c/thing';

@Component({
    selector: 'app-thing',
    templateUrl: './thing.component.html',
    styleUrls: ['./thing.component.css']
})
export class ThingComponent implements OnInit {
    @Input() thing: Thing;
    @Output() deleteMe: EventEmitter<boolean> = new EventEmitter<boolean>();
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
            this.deleteMe.next(true);
        }
    }
}
