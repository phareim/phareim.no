import {Component, OnInit} from '@angular/core';
import {Http} from '@angular/http';

@Component({
    selector: 'app-p4',
    templateUrl: './p4.component.html',
    styleUrls: ['./p4.component.css']
})
export class P4Component implements OnInit {
    ticker: any[];

    constructor(private http: Http) {
    }

    ngOnInit() {
        this.http.get('https://api.coinmarketcap.com/v1/ticker/').subscribe((ticker: any) => {
            this.ticker = ticker.json();
        });
    }
}
